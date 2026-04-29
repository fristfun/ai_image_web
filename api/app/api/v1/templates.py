from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import ApiError
from app.models.prompt_template_variable import PromptTemplateVariable
from app.models.template import PromptTemplate
from app.models.user import User

router = APIRouter(prefix="/templates", tags=["templates"])


def serialize_template(item: PromptTemplate, variables_by_template: dict[int, list[dict[str, str]]]) -> dict:
    return {
        "id": item.id,
        "category": item.category,
        "title": item.title,
        "content": item.content,
        "variable_desc": item.variable_desc,
        "effect_image_url": item.effect_image_url,
        "default_size": item.default_size,
        "default_quality": item.default_quality,
        "variables": variables_by_template[item.id],
    }


@router.get("")
def list_templates(
    primary_category: str | None = Query(default=None),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(PromptTemplate)
    if primary_category:
        query = query.filter(PromptTemplate.category == primary_category.strip())
    templates = query.order_by(desc(PromptTemplate.id)).limit(100).all()
    template_ids = [item.id for item in templates]
    variables_by_template: dict[int, list[dict[str, str]]] = {item_id: [] for item_id in template_ids}

    if template_ids:
        variables = (
            db.query(PromptTemplateVariable)
            .filter(PromptTemplateVariable.template_id.in_(template_ids))
            .order_by(PromptTemplateVariable.id.asc())
            .all()
        )
        for variable in variables:
            variables_by_template[variable.template_id].append(
                {
                    "name": variable.name,
                    "description": variable.description,
                    "example_value": variable.example_value,
                }
            )

    return [serialize_template(item, variables_by_template) for item in templates]


@router.get("/{template_id}")
def get_template(template_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if item is None:
        raise ApiError(code="NOT_FOUND", message="模板不存在", status_code=404)

    variables = (
        db.query(PromptTemplateVariable)
        .filter(PromptTemplateVariable.template_id == item.id)
        .order_by(PromptTemplateVariable.id.asc())
        .all()
    )
    variables_by_template = {
        item.id: [
            {
                "name": variable.name,
                "description": variable.description,
                "example_value": variable.example_value,
            }
            for variable in variables
        ]
    }
    return serialize_template(item, variables_by_template)
