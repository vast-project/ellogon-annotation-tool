# Generated by Django 4.0.3 on 2022-09-18 15:05

import clarin_backend.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clarin_backend', '0007_documents_data_image'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documents',
            name='data_image',
            field=models.ImageField(blank=True, default=None, max_length=255, null=True, upload_to=clarin_backend.models.user_collection_directory_path),
        ),
    ]
